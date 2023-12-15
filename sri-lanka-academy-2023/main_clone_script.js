import * as fs from 'fs';
import CloneProgramMetadataJob from "./clone_metadata_program.js";
import CreateVisualization from "./create_visualization.js";
import UpdateProgramSharing from "./update_program_sharing.js";
import UpdateRoleJob from "./update_role_authorities.js";
import RemoveProgramIndicatorRules from "./remove_program_indicator_rules.js";
import CreateInstanceVisualization from "./create_instance_visualization.js";
import CloneTeiJob from "./clone_tei.js";

const superAdminUser = {
    username: "admin",
    password: "district",
    userId: "M5zQapPyTZI",
    group: "pey6425xXt5"
}

const templateInfo = {
    baseAndroidUserId: "zGnHx4TUCTM",
    baseAdminUserId: "sH7G8eVjHfc",
    baseProgramId: "SSLpOM0r1U7"
}

const usersFilePath = "users.csv";
const mappingFilePath = "mapping.json";

const programRuleToDelete = [
    "rhispzm1059",  // There is an error in the metadata
    "q7JTl3XcJ75"   // Temp > 37 (for exercise)
];

const instances = [
    {url: "https://academy.demos.dhis2.org/android1", from: 1, to: 5},
    {url: "https://academy.demos.dhis2.org/android2", from: 6, to: 10},
    {url: "https://academy.demos.dhis2.org/android3", from: 11, to: 15},
    {url: "https://academy.demos.dhis2.org/android4", from: 16, to: 20},
    {url: "https://academy.demos.dhis2.org/android5", from: 21, to: 25},
    {url: "https://academy.demos.dhis2.org/android6", from: 26, to: 30},
    {url: "https://academy.demos.dhis2.org/android7", from: 31, to: 35},
    {url: "https://academy.demos.dhis2.org/android8", from: 36, to: 40},
    {url: "https://academy.demos.dhis2.org/android9", from: 41, to: 45},
];

async function main() {

    //await new CloneTeiJob(superAdminUser, instances, "mappings/mapping_compiled.json", ["F8IBumV6T1q", "bdGNIIG7hKG"]).doWork();

    //await new UpdateProgramSharing(superAdminUser, instances, "mappings/mapping_compiled.json").doWork();

    const job = new UpdateRoleJob(superAdminUser, instances, "p8rj2488UOX",
        [], ["ALL"]);

    await job.doWork();

    /*
    fs.writeFileSync(usersFilePath, "");
    fs.writeFileSync(mappingFilePath, "[]");

    for (let instance of instances) {
        const cloneMetadataInstance = new CloneProgramMetadataJob(
            instance.url,
            superAdminUser,
            templateInfo,
            programRuleToDelete,
            usersFilePath,
            mappingFilePath
        );

        await cloneMetadataInstance.doWork(instance.from, instance.to);
    }
     */
}

const start = new Date().getTime();
main().then(() => {
    const end = new Date().getTime();
    console.log("Process completed in " + ((end - start) / 1000) + " seconds.");
});
