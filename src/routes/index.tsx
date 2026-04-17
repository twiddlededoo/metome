import { createFileRoute } from "@tanstack/react-router";
import { DocumentUploadPage } from "@/components/DocumentUploadPage";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Document Upload - Case Filing" },
      { name: "description", content: "Upload case documents for e-filing" },
    ],
  }),
});

function Index() {
  return <DocumentUploadPage />;
}
