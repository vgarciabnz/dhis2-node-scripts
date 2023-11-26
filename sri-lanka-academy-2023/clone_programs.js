import * as fs from 'fs';
import CloneProgramMetadataInstance from "./clone_metadata_program.js";

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

async function main() {
    const instances = [
        {url: "http://localhost:8080", from: 14, to: 15},
    ];

    fs.writeFileSync(usersFilePath, "");
    fs.writeFileSync(mappingFilePath, "[]");

    for (let instance of instances) {
        const cloneMetadataInstance = new CloneProgramMetadataInstance(
            instance.url,
            superAdminUser,
            templateInfo,
            programRuleToDelete,
            usersFilePath,
            mappingFilePath
        );

        await cloneMetadataInstance.cloneMetadata(instance.from, instance.to);
    }
}

const start = new Date().getTime();
main().then(() => {
    const end = new Date().getTime();
    console.log("Process completed in " + ((end - start) / 1000) + " seconds.");
});
