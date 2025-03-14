/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Progress } from 'vscode';
import { gitignoreFileName, hostFileName, localSettingsFileName, ProjectRuntime, proxiesFileName, workerRuntimeKey } from '../../../constants';
import { IHostJsonV1, IHostJsonV2 } from '../../../funcConfig/host';
import { ILocalSettingsJson } from '../../../funcConfig/local.settings';
import { confirmOverwriteFile, writeFormattedJson } from "../../../utils/fs";
import { nonNullProp } from '../../../utils/nonNull';
import { getFunctionsWorkerRuntime } from '../../../vsCodeConfig/settings';
import { IProjectWizardContext } from '../IProjectWizardContext';
import { ProjectCreateStepBase } from './ProjectCreateStepBase';

export class ScriptProjectCreateStep extends ProjectCreateStepBase {
    protected funcignore: string[] = ['.git*', '.vscode', 'local.settings.json', 'test'];
    protected gitignore: string = '';
    protected supportsManagedDependencies: boolean = false;

    public async executeCore(context: IProjectWizardContext, _progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        const runtime: ProjectRuntime = nonNullProp(context, 'runtime');
        const hostJsonPath: string = path.join(context.projectPath, hostFileName);
        if (await confirmOverwriteFile(hostJsonPath)) {
            const hostJson: IHostJsonV2 | IHostJsonV1 = this.getHostContent(runtime);
            await writeFormattedJson(hostJsonPath, hostJson);
        }

        const localSettingsJsonPath: string = path.join(context.projectPath, localSettingsFileName);
        if (await confirmOverwriteFile(localSettingsJsonPath)) {
            const localSettingsJson: ILocalSettingsJson = {
                IsEncrypted: false,
                Values: {
                    AzureWebJobsStorage: ''
                }
            };

            const functionsWorkerRuntime: string | undefined = getFunctionsWorkerRuntime(context.language);
            if (functionsWorkerRuntime) {
                // tslint:disable-next-line:no-non-null-assertion
                localSettingsJson.Values![workerRuntimeKey] = functionsWorkerRuntime;
            }

            await writeFormattedJson(localSettingsJsonPath, localSettingsJson);
        }

        const proxiesJsonPath: string = path.join(context.projectPath, proxiesFileName);
        if (await confirmOverwriteFile(proxiesJsonPath)) {
            await writeFormattedJson(proxiesJsonPath, {
                // tslint:disable-next-line:no-http-string
                $schema: 'http://json.schemastore.org/proxies',
                proxies: {}
            });
        }

        const gitignorePath: string = path.join(context.projectPath, gitignoreFileName);
        if (await confirmOverwriteFile(gitignorePath)) {
            await fse.writeFile(gitignorePath, this.gitignore.concat(`
# Azure Functions artifacts
bin
obj
appsettings.json
local.settings.json`));
        }

        const funcIgnorePath: string = path.join(context.projectPath, '.funcignore');
        if (await confirmOverwriteFile(funcIgnorePath)) {
            await fse.writeFile(funcIgnorePath, this.funcignore.sort().join(os.EOL));
        }
    }

    private getHostContent(runtime: ProjectRuntime): IHostJsonV2 | IHostJsonV1 {
        if (runtime === ProjectRuntime.v2) {
            if (this.supportsManagedDependencies) {
                return {
                    version: '2.0',
                    managedDependency: {
                        enabled: true
                    }
                };
            }

            return { version: '2.0' };
        }

        // runtime === ProjectRuntime.v1
        return {};
    }
}
