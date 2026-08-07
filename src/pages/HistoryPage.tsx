import { Clock3 } from "lucide-react";

function HistoryPage() {
    return (
        <section className="placeholder-page">
            <Clock3 size={42} />
            <h3>Conversation History</h3>
            <p>Your previous chats will appear here.</p>
        </section>
    );
}

export default HistoryPage;