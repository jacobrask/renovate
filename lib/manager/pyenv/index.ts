import { ProgrammingLanguage } from '../../constants';
import { DockerDatasource } from '../../datasource/docker';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const supportedDatasources = [DockerDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/).python-version$'],
  versioning: dockerVersioning.id,
};
