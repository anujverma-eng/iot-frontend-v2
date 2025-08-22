import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import App from "./App.tsx";
import { store } from "./store";
import "./index.css";
import AuthBootstrap from "./lib/auth/AuthBootstrap.tsx";
import './lib/amplify';

ReactDOM.createRoot(document.getElementById("root")!).render(
	<Provider store={store}>
	<React.StrictMode>
		<HeroUIProvider>
		<ToastProvider />
		<AuthBootstrap />
			<main className="text-foreground bg-background">
				<App />
			</main>
		</HeroUIProvider>
	</React.StrictMode>
	</Provider>
);
