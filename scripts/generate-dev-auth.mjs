import { randomBytes, webcrypto } from "node:crypto";
import { stdin, stdout } from "node:process";

const ITERATIONS = 600000;

if (!stdin.isTTY || !stdout.isTTY) {
  console.error("Run this utility in an interactive terminal.");
  process.exit(1);
}

stdout.write("Developer password (input hidden): ");
stdin.setEncoding("utf8");
stdin.setRawMode(true);
stdin.resume();
let password = "";

function finishInput() {
  stdin.setRawMode(false);
  stdin.pause();
  stdin.removeAllListeners("data");
  stdout.write("\n");
}

stdin.on("data", async (chunk) => {
  for (const character of chunk) {
    if (character === "\u0003") {
      finishInput();
      process.exit(130);
    }
    if (character === "\r" || character === "\n") {
      finishInput();
      if ([...password].length < 12) {
        console.error("Use a password with at least 12 characters.");
        process.exitCode = 1;
        return;
      }
      const salt = randomBytes(16);
      const key = await webcrypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const hash = Buffer.from(
        await webcrypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: ITERATIONS,
          },
          key,
          256,
        ),
      );
      console.log(
        `VIVA_DEV_PASSWORD_HASH=pbkdf2-sha256$v1$${ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`,
      );
      console.log(`VIVA_SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
      password = "";
      return;
    }
    if (character === "\u007f" || character === "\b") {
      password = [...password].slice(0, -1).join("");
      continue;
    }
    if (character >= " " && character !== "\u007f") password += character;
  }
});
