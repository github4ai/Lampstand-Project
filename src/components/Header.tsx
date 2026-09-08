import { Bell, CircleUserRound } from "lucide-react";
import { useLocation } from "react-router-dom";
import { APP_NAME, APP_TAGLINE } from "../config/brand";

const pageTitles: Record<string, string> = {
    "/chat": "AI Chat",
    "/documents": "Documents",
    "/knowledge": "Knowledge Base",
    "/agents": "AI Agents",
    "/history": "Conversation History",
    "/hymnal": "Hymnal",
    "/recovery-bible": "Recovery Bible",
    "/life-study": "Life-Study of the Bible",
    "/ministry-books": "Books",
    "/ministry": "Ministry",
    "/church": "Church",
    "/church/prayer-points": "Prayer Points",
    "/church/announcements": "Church Announcements",
    "/church/posting-history": "Church Posting History",
    "/church/groups": "Church WhatsApp Groups",
    "/media": "Media Studio",
    "/language-tools": "Language Tools",
    "/settings": "Settings",
    "/updates": "App Updates",
};

function Header() {
    const location = useLocation();
    const title = pageTitles[location.pathname] ?? APP_NAME;

    return (
        <header className="topbar">
            <div>
                <h2>{title}</h2>
                <p>{APP_TAGLINE} Private, local, and powered by your own models.</p>
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
