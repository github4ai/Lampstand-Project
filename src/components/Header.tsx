import { Bell, CircleUserRound } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
    "/chat": "AI Chat",
    "/documents": "Documents",
    "/knowledge": "Knowledge Base",
    "/agents": "AI Agents",
    "/history": "Conversation History",
    "/hymnal": "Ministry Hymnal",
    "/media": "Media Studio",
    "/settings": "Settings",
};

function Header() {
    const location = useLocation();
    const title = pageTitles[location.pathname] ?? "AIOS Studio";

    return (
        <header className="topbar">
            <div>
                <h2>{title}</h2>
                <p>Private, local and powered by your own models</p>
            </div>

            <div className="topbar-actions">
                <button className="icon-button" type="button" aria-label="Notifications">
                    <Bell size={19} />
                </button>

                <button className="profile-button" type="button">
                    <CircleUserRound size={21} />
                    <span>Condrad</span>
                </button>
            </div>
        </header>
    );
}

export default Header;