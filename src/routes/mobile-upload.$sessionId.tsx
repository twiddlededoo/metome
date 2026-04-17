import { createFileRoute } from "@tanstack/react-router";
import { MobileUploadPage } from "@/components/MobileUploadPage";

export const Route = createFileRoute("/mobile-upload/$sessionId")({
  component: MobileUpload,
  head: () => ({
    meta: [
      { title: "Mobile Document Upload" },
      { name: "description", content: "Upload documents from your mobile device" },
    ],
  }),
});

function MobileUpload() {
  const { sessionId } = Route.useParams();
  return <MobileUploadPage sessionId={sessionId} />;
}
