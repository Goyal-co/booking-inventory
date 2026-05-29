const { execSync } = require("child_process");

const port = process.argv[2];
if (!port) process.exit(0);

function killOnWindows() {
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

function killOnUnix() {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
    console.log(`Freed port ${port}`);
  } catch {
    // nothing listening
  }
}

if (process.platform === "win32") {
  killOnWindows();
} else {
  killOnUnix();
}
