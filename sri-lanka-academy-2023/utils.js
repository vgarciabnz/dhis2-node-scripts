import fs from "fs";

export default class Utils {

    static prefix(idx, str) {
        return `[User ${idx}] ${str}`
    }

    static copy(object) {
        return JSON.parse(JSON.stringify(object));
    }

    static readAndParseFile(filePath) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
}
