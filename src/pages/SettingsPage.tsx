import { Settings } from "lucide-react";

function SettingsPage() {
    return (
        <section className="placeholder-page">
            <Settings size={42} />
            <h3>Settings</h3>
            <p>Configure Ollama, API services, models and application preferences.</p>
        </section>
    );
}

export default SettingsPage;