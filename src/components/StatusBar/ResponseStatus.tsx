import {
  BookOpen,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

interface ResponseStatusProps {
  grounded?: boolean;
  completed?: boolean;
  model?: string;
}

function ResponseStatus({
  grounded,
  completed,
  model,
}: ResponseStatusProps) {
  return (
    <div className="response-status">
      {grounded ? (
        <span className="grounded-badge">
          <ShieldCheck size={14} />
          Grounded
        </span>
      ) : (
        <span className="ungrounded-badge">
          <BookOpen size={14} />
          No relevant context
        </span>
      )}

      {model && (
        <span className="model-badge">
          {model}
        </span>
      )}

      {completed && (
        <span className="completed-badge">
          <CheckCircle2 size={14} />
          Complete
        </span>
      )}
    </div>
  );
}

export default ResponseStatus;