import { FileUp } from "lucide-react";

function DocumentsPage() {
    return (
        <section className="placeholder-page">
            <FileUp size={42} />
            <h3>Document Library</h3>
            <p>Upload, inspect, OCR and organize your files.</p>
        </section>
    );
}

export default DocumentsPage;