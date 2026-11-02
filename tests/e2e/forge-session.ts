// Test only: mint a session cookie for a given login, signed with the local AUTH_SECRET.
import { encode } from "@auth/core/jwt";
const [login, secret] = process.argv.slice(2);
encode({ token: { login, accessToken: "mock-token", sub: "1" }, secret, salt: "authjs.session-token" }).then((t) => process.stdout.write(t));
