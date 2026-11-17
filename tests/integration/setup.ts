// Local runs read DATABASE_URL from `.env`; in CI it comes from the job's environment, which dotenv
// never overrides.
import "dotenv/config";
