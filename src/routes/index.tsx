import { createFileRoute } from "@tanstack/react-router";
import { QRTransferPage } from "@/components/QRTransferPage";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "QR File Transfer" },
      { name: "description", content: "Instantly transfer files from your phone to your computer using QR codes" },
    ],
  }),
});

function Index() {
  return <QRTransferPage />;
}
