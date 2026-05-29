import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const healthRes = http.get(`${BASE_URL}/login`);
  check(healthRes, {
    "login page status 200": (r) => r.status === 200,
  });
  sleep(1);
}
