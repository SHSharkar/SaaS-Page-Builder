type LogTag = "INFO" | "SUCCESS" | "WARNING" | "FAILED";

function write(tag: LogTag, message: string): void {
  process.stderr.write(`[${tag}] ${message}\n`);
}

export const log = {
  info(message: string): void {
    write("INFO", message);
  },
  success(message: string): void {
    write("SUCCESS", message);
  },
  warning(message: string): void {
    write("WARNING", message);
  },
  failed(message: string): void {
    write("FAILED", message);
  },
};
