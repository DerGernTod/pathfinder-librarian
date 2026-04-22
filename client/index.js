import { MainPage } from "./pages/main-page.js";
import { client } from "./utils/rpc-client.js";

const res = await client.api.query.$get({ query: { foo: "baroo" } });
const data = await res.json();
console.log(data.message + "igggg");

export { MainPage };