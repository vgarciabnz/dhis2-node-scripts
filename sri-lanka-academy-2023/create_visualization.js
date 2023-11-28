import DHIS2HttpClient from "./dhis_http_client.js";
import fs from "fs";
import Utils from "./utils.js";

export default class CreateVisualization {

    logFile = "mappings/visualizations_bcg_doses_given.json";
    visualizationPath = "visualizations/bcg_doses_given.json";

    constructor(
        user,
        instances,
        mappingFile,
    ) {
        this.user = user;
        this.instances = instances;

        this.mappings = Utils.readAndParseFile(mappingFile);
    }

    async doWork() {
        const templateVisualization = Utils.readAndParseFile(this.visualizationPath);

        fs.writeFileSync(this.logFile, "[]");

        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            for (let id = instance.from; id <= instance.to; id++) {
                const userConfig = this.mappings.find(m => m.userIdx === id);
                await this.copyForUser(httpClient, userConfig, templateVisualization);
            }
        }
    }

    async copyForUser(httpClient, userConfig, templateVisualization) {
        console.log(`Start import for user ${userConfig.userIdx} (${userConfig.url})`)
        const visualization = Utils.copy(templateVisualization);

        visualization.id = (await httpClient.getIds(1))[0];
        visualization.name = Utils.prefix(userConfig.userIdx, visualization.name);

        // Map data
        // TODO
        visualization.dataDimensionItems.forEach(item => {
            if (item.dataDimensionItemType === "PROGRAM_INDICATOR") {
                item.programIndicator.id = userConfig.mapping.programIndicators[item.programIndicator.id];
            }
        })

        const usersSharing = {};
        usersSharing[userConfig.adminUserId] = {"access": "rw------", "id": userConfig.adminUserId};
        usersSharing[this.user.userId] = {"access": "rw------", "id": this.user.userId};

        const userGroupsSharing = {};
        userGroupsSharing[this.user.group] = {"access": "rw------", "id": this.user.group};

        visualization.sharing = {
            "public": "r-------",
            "users": usersSharing,
            "userGroups": userGroupsSharing
        };

        this.appendToLogFile(userConfig, visualization.id);

        const visualizationPayload = {
            "visualizations": [visualization]
        };

        const mode = "COMMIT";
        await httpClient.postToMetadata(visualizationPayload, mode);
        console.log("\n");
    }

    appendToLogFile(userConfig, visualizationId) {
        const existingContent = fs.readFileSync(this.logFile, "utf-8");
        const existingVisualizations = JSON.parse(existingContent);

        const newVisualizations = existingVisualizations.concat({
            "url": userConfig.url,
            "userIdx": userConfig.userIdx,
            "visualizationId": visualizationId
        });

        fs.writeFileSync(this.logFile, JSON.stringify(newVisualizations, null, 2));
    }
}
