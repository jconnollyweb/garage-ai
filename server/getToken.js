import readline from "readline";
import fs from "fs";
import { authorize } from "./googleAuth.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const auth = await authorize();

if (!auth.credentials.refresh_token) {

  rl.question("Enter code: ", async (code) => {

    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    fs.writeFileSync("google-token.json", JSON.stringify(tokens));

    console.log("Token saved.");

    rl.close();
  });

}