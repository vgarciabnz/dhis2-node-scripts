import DHIS2HttpClient from "./dhis_http_client.js";
import fs from "fs";
import Utils from "./utils.js";

export default class CreateInstanceVisualization {

    visualizationPath = "visualizations/anc_contact.json";

    constructor(
        user,
        instances,
    ) {
        this.user = user;
        this.instances = instances;
    }

    async doWork() {
        const templateVisualization = Utils.readAndParseFile(this.visualizationPath);

        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            console.log(`Start import for instance ${instance.url}`);

            await httpClient.postToMetadata({"visualizations": [templateVisualization]});
        }
    }
}
