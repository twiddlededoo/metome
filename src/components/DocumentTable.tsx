import { useState } from "react";
import { Upload, Trash2, CheckCircle2, Info, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { UploadModal } from "@/components/UploadModal";

interface DocumentRow {
  id: number;
  name: string;
  nativelyDigital: boolean;
  fileName?: string;
  uploaded: boolean;
}

interface DocumentTableProps {
  title: string;
  initialDocs: DocumentRow[];
  showQualityBadges?: boolean;
}

export function DocumentTable({ title, initialDocs, showQualityBadges = false }: DocumentTableProps) {
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs);
  const [uploadingDocId, setUploadingDocId] = useState<number | null>(null);

  const handleUpload = (id: number) => {
    setUploadingDocId(id);
  };

  const handleFileSelected = (file: File) => {
    if (uploadingDocId !== null) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === uploadingDocId ? { ...d, fileName: file.name, uploaded: true } : d
        )
      );
      setUploadingDocId(null);
    }
  };

  const handleDelete = (id: number) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, fileName: undefined, uploaded: false } : d))
    );
  };

  const handleToggleDigital = (id: number) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, nativelyDigital: !d.nativelyDigital } : d))
    );
  };

  const addRow = () => {
    const nextId = Math.max(...docs.map((d) => d.id)) + 1;
    setDocs((prev) => [
      ...prev,
      { id: nextId, name: "", nativelyDigital: false, uploaded: false },
    ]);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {showQualityBadges && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive">
              <span className="text-base">😞</span> Bad Quality
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/5 px-3 py-1 text-xs font-medium text-success">
              <span className="text-base">✅</span> Good Quality
            </span>
          </div>
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-2.5 font-semibold text-foreground w-16">Sl.No</th>
              <th className="text-left px-4 py-2.5 font-semibold text-foreground">Document Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-foreground w-28">Action</th>
              <th className="text-center px-4 py-2.5 font-semibold text-foreground w-36">
                <span className="inline-flex items-center gap-1">
                  Natively Digital
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-foreground w-52"></th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, idx) => (
              <tr key={doc.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-3 text-foreground">{doc.name}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleUpload(doc.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-upload-btn-border bg-upload-btn-bg px-3 py-1.5 text-xs font-medium text-upload-btn-text hover:bg-accent transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={doc.nativelyDigital}
                    onCheckedChange={() => handleToggleDigital(doc.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  {doc.uploaded && doc.fileName ? (
                    <a href="#" className="text-step-active underline text-xs truncate block max-w-[180px]">
                      {doc.fileName}
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">No file chosen</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {doc.uploaded && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="px-4 py-3" colSpan={6}>
                <button
                  onClick={addRow}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add other documents
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UploadModal
        open={uploadingDocId !== null}
        onClose={() => setUploadingDocId(null)}
        onFileSelected={handleFileSelected}
      />
    </div>
  );
}
