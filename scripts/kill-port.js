const { execSync } = require("child_process");

const wait = process.argv.includes("--wait");
const ports = process.argv.slice(2).filter((a) => a !== "--wait");
const targets = ports.length ? ports : ["3000", "3001", "3002"];

function killOnWindows(port) {
  let output;
  try {
    output = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8" });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes("LISTENING")) continue;
    const pid = trimmed.split(/\s+/).pop();
    if (pid && pid !== "0") pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Freed port ${port} (stopped PID ${pid})`);
    } catch {
      // already gone
    }
  }
}

function killOnUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
    console.log(`Freed port ${port}`);
  } catch {
    // nothing listening
  }
}

for (const port of targets) {
  if (process.platform === "win32") {
    killOnWindows(port);
  } else {
    killOnUnix(port);
  }
}

if (wait) {
  const cmd =
    process.platform === "win32"
      ? "powershell -Command Start-Sleep -Seconds 2"
      : "sleep 2";
  execSync(cmd, { stdio: "ignore" });
}
