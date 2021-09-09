import type { Merge } from 'type-fest';
import type { RenovateConfig, ValidationMessage } from '../../../config/types';
import { addMeta, logger, removeMeta } from '../../../logger';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import { embedChangelogs } from '../changelog';
import { flattenUpdates } from './flatten';
import { generateBranchConfig } from './generate';

export type BranchifiedConfig = Merge<
  RenovateConfig,
  {
    branches: BranchConfig[];
    branchList: string[];
  }
>;
export async function branchifyUpgrades(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>
): Promise<BranchifiedConfig> {
  logger.debug('branchifyUpgrades');
  const updates = await flattenUpdates(config, packageFiles);
  logger.debug(
    `${updates.length} flattened updates found: ${updates
      .map((u) => u.depName)
      .filter((txt) => txt?.length)
      .join(', ')}`
  );
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const branchUpgrades: Record<string, BranchUpgradeConfig[]> = {};
  const branches: BranchConfig[] = [];
  for (const u of updates) {
    const update: BranchUpgradeConfig = { ...u } as any;
    branchUpgrades[update.branchName] = branchUpgrades[update.branchName] || [];
    branchUpgrades[update.branchName] = [update].concat(
      branchUpgrades[update.branchName]
    );
  }
  logger.debug(`Returning ${Object.keys(branchUpgrades).length} branch(es)`);
  if (config.fetchReleaseNotes) {
    await embedChangelogs(branchUpgrades);
  }
  for (const branchName of Object.keys(branchUpgrades)) {
    // Add branch name to metadata before generating branch config
    addMeta({
      branch: branchName,
    });

    // Filter out duplicates
    const deDupMap: Record<string, BranchUpgradeConfig> = {};
    branchUpgrades[branchName].forEach((upgrade) => {
      const { manager, packageFile, depName, currentValue, newValue } = upgrade;
      const upgradeKey = `${packageFile}:${depName}:${currentValue}`;
      const upgradeValue = deDupMap[upgradeKey];

      if (!upgradeValue?.logJSON) {
        deDupMap[upgradeKey] = upgrade;
        return;
      }
      logger.info(
        {
          manager,
          packageFile,
          depName,
          currentValue,
          thisNewValue: newValue,
        },
        'Ignoring upgrade collision'
      );
    });
    branchUpgrades[branchName] = Object.values(deDupMap);

    const branch = generateBranchConfig(branchUpgrades[branchName]);
    branch.branchName = branchName;
    branch.packageFiles = packageFiles;
    branches.push(branch);
  }
  removeMeta(['branch']);
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  const branchList = config.repoIsOnboarded
    ? branches.map((upgrade) => upgrade.branchName)
    : config.branchList;
  // istanbul ignore next
  try {
    // Here we check if there are updates from the same source repo
    // that are not grouped into the same branch
    const branchUpdates: Record<string, Record<string, string>> = {};
    for (const branch of branches) {
      const { sourceUrl, branchName, depName, newVersion } = branch;
      if (sourceUrl && newVersion) {
        const key = `${sourceUrl}|${newVersion}`;
        branchUpdates[key] = branchUpdates[key] || {};
        if (!branchUpdates[key][branchName]) {
          branchUpdates[key][branchName] = depName;
        }
      }
    }
    for (const [key, value] of Object.entries(branchUpdates)) {
      if (Object.keys(value).length > 1) {
        const [sourceUrl, newVersion] = key.split('|');
        logger.debug(
          { sourceUrl, newVersion, branches: value },
          'Found sourceUrl with multiple branches that should probably be combined into a group'
        );
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Error checking branch duplicates');
  }
  return {
    errors: config.errors.concat(errors),
    warnings: config.warnings.concat(warnings),
    branches,
    branchList,
  };
}
