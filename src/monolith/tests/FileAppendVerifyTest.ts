import * as fs from "fs";
import * as path from "path";
import { appendToFile } from "../plumbing/filesystem/FileService.js";

async function verifyFileAppend() {
  const testFile = path.join(process.cwd(), "test_append.txt");

  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

  console.log(`Verifying appendToFile for: ${testFile}`);

  let totalBytesAppended = 0;
  const onProgress = (b: number) => {
    totalBytesAppended += b;
    console.log(`Progress: +${b} bytes (Total: ${totalBytesAppended})`);
  };

  await appendToFile(testFile, "Line 1\n", undefined, onProgress);
  await appendToFile(testFile, "Line 2\n", undefined, onProgress);

  const content = fs.readFileSync(testFile, "utf-8");
  console.log(`Content:\n${content}`);

  if (content !== "Line 1\nLine 2\n") {
    throw new Error("File append verification failed!");
  }

  console.log("✅ File append verification successful!");
  fs.unlinkSync(testFile);
}

verifyFileAppend().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
