// src/App.tsx
import { Footer } from './components/footer';
import { AppRouter } from './router';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <AppRouter />
      </main>
    </div>
  );
}
