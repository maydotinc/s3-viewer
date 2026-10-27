import { consoleLogger, type Logger } from "@s3-viewer/shared";

let current: Logger = consoleLogger;

// the API hands over its leveled JSON logger; any other host keeps the console.
const setAuthLogger = (logger: Logger): void => {
   current = logger;
};

const authLog = (): Logger => current;

export { authLog, setAuthLogger };
