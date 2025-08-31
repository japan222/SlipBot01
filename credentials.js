import dotenv from "dotenv";

dotenv.config({ path: './cred.env' });

const owner = {
  username: process.env.OWNER_USERNAME || "",
  password: process.env.OWNER_PASSWORD || ""
};

const admins = [];
let index = 1;

while (
  process.env[`ADMIN${index}_USERNAME`] &&
  process.env[`ADMIN${index}_PASSWORD`]
) {
  admins.push({
    username: process.env[`ADMIN${index}_USERNAME`],
    password: process.env[`ADMIN${index}_PASSWORD`]
  });
  index += 1;
}

const credentials = { owner, admins };
export default credentials;