import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./app/router";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/orbit.css";
import "./styles/workbench.css";
import "./styles/radar.css";
import "./styles/gem-plan.css";
import "./styles/mobile-experience.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
