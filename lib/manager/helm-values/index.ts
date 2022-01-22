import * as datasourceDocker from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values.yaml$'],
  pinDigests: false,
};

export const supportedDatasources = [datasourceDocker.id];
