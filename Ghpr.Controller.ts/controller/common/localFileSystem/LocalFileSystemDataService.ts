﻿///<reference path="./../../interfaces/IDataService.ts"/>
///<reference path="./../../dto/RunDto.ts"/>
///<reference path="./../../dto/ReportSettingsDto.ts"/>
///<reference path="./../../dto/TestRunDto.ts"/>
///<reference path="./../../dto/ItemInfoDto.ts"/>
///<reference path="./entities/Run.ts"/>
///<reference path="./entities/ItemInfo.ts"/>
///<reference path="./mappers/RunDtoMapper.ts"/>
///<reference path="./mappers/ItemInfoDtoMapper.ts"/>
///<reference path="./../../enums/PageType.ts"/>
///<reference path="./../ProgressBar.ts"/>
///<reference path="./../JsonParser.ts"/>

class LocalFileSystemDataService implements IDataService {

    private currentPage: PageType;
    private progressBar: ProgressBar;
    reportSettings: ReportSettingsDto;
    reviveRun = JsonParser.reviveRun;

    fromPage(pageType: PageType): IDataService {
        this.currentPage = pageType;
        return this;
    }

    getRun(runGuid: string, callback: (runDto: RunDto) => void): void {
        const path = LocalFileSystemPathsHelper.getRunPath(this.currentPage, runGuid);
        this.loadJsonsByPaths([path], 0, new Array(), false, true, (response: string) => {
            const run: Run = JSON.parse(response, this.reviveRun);
            const runDto = RunDtoMapper.map(run);
            if (runDto.name === "") {
                runDto.name = `${DateFormatter.format(runDto.runInfo.start)} - ${DateFormatter.format(runDto.runInfo.finish)}`;
            }
            callback(runDto);
        });
    }

    getLatestRuns(callback: (runDtos: Array<RunDto>, total: number) => void): void {
        const path = LocalFileSystemPathsHelper.getRunsPath(this.currentPage);
        this.loadJsonsByPaths([path], 0, new Array(), false, true, (response: string) => {
            let runInfos: Array<ItemInfo> = JSON.parse(response, this.reviveRun);
            runInfos = runInfos.sort(Sorter.itemInfoByFinishDateDesc);
            let totalCount = runInfos.length;
            const runsToLoad = this.reportSettings.runsToDisplay >= 1 ? Math.min(this.reportSettings.runsToDisplay, runInfos.length) : runInfos.length;
            let runInfosDto: Array<ItemInfoDto> = new Array(runsToLoad);
            for (let i = 0; i < runsToLoad; i++) {
                runInfosDto[i] = ItemInfoDtoMapper.map(runInfos[i]);
            }
            const paths: Array<string> = new Array();
            for (let i = 0; i < runsToLoad; i++) {
                paths[i] = `runs/run_${runInfosDto[i].guid}.json`;
            }
            const runs: Array<RunDto> = new Array();
            this.loadJsonsByPaths(paths, 0, new Array(), false, false, (responses: Array<string>) => {
                for (let i = 0; i < responses.length; i++) {
                    const loadedRun: Run = JSON.parse(responses[i], this.reviveRun);
                    if (loadedRun.name === "") {
                        loadedRun.name = `${DateFormatter.format(loadedRun.runInfo.start)} - ${DateFormatter.format(loadedRun.runInfo.finish)}`;
                    }
                    runs[i] = RunDtoMapper.map(loadedRun);
                }
                callback(runs, totalCount);
            });
        });
    }

    getLatestTest(testGuid: string, start: Date, finish: Date, callback: Function): void {
        throw new Error("Not implemented");
    }

    getLatestTests(testGuid: string, count: number, callback: Function): void {
         throw new Error("Not implemented");
    }

    getRunTests(runGuid: string, start: Date, finish: Date, callback: Function): void {
        throw new Error("Not implemented");
    }

    loadJsonsByPaths(paths: Array<string>, ind: number, responses: Array<string>, showProgressBar: boolean, callbackForEach: boolean, callback: Function): void {
        const count = paths.length;
        if (showProgressBar) {
            this.progressBar.reset(count);
            if (ind === 0) {
                this.progressBar.show();
            }
            if (ind >= count) {
                this.progressBar.hide();
                return;
            }
        }
        if (!callbackForEach && ind >= count) {
            callback(responses, count, ind);
        }
        if (ind >= count) {
            return;
        }
        const req = new XMLHttpRequest();
        req.overrideMimeType("application/json");
        req.open("get", paths[ind], true);
        req.onreadystatechange = () => {
            if (req.readyState === 4)
                if (req.status !== 200 && req.status !== 0) {
                    console
                        .log(`Error while loading .json data: '${paths[ind]}'! Request status: ${req.status} : ${req.statusText}`);
                } else {
                    responses[ind] = req.responseText;
                    if (callbackForEach) {
                        callback(req.responseText, count, ind);
                    }
                    if (showProgressBar) {
                        this.progressBar.onLoaded(ind);
                    }
                    ind++;
                    this.loadJsonsByPaths(paths, ind, responses, showProgressBar, callbackForEach, callback);
                }
        }
        req.timeout = 2000;
        req.ontimeout = () => {
            console.log(`Timeout while loading .json data: '${paths[ind]}'! Request status: ${req.status} : ${req.statusText}`);
        };
        req.send(null);
    }
}