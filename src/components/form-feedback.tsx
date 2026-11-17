/** The messages under one field: referenced by the field's `aria-describedby`. */
export function FieldMessages({ id, messages }: { id: string; messages: string[] | undefined }) {
  if (!messages || messages.length === 0) {
    return null;
  }
  return (
    <ul id={id} className="flex flex-col gap-1 text-sm text-destructive">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

/** The form's single general message, announced as it appears. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
    >
      {message}
    </p>
  );
}

/** The ids a field is described by: its hint and, when it has any, its error messages. */
export function describedBy(...entries: (string | false | undefined)[]): string | undefined {
  const ids = entries.filter((entry): entry is string => typeof entry === "string" && entry !== "");
  return ids.length > 0 ? ids.join(" ") : undefined;
}
