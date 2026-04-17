import { Info, ArrowRight } from "lucide-react";
import { StepSidebar } from "./StepSidebar";
import { TopNav } from "./TopNav";
import { DocumentTable } from "./DocumentTable";
import { Button } from "@/components/ui/button";

const caseDocuments = [
  { id: 1, name: "Cheque 1", nativelyDigital: false, uploaded: false },
  { id: 2, name: "Cheque 2", nativelyDigital: false, uploaded: false },
  { id: 3, name: "Cheque return memo", nativelyDigital: false, uploaded: false },
  { id: 4, name: "Demand notice 1", nativelyDigital: false, uploaded: false },
  { id: 5, name: "Demand notice 2", nativelyDigital: false, uploaded: false },
  { id: 6, name: "Proof of dispatch of demand notice (postal receipt)", nativelyDigital: false, uploaded: false },
  { id: 7, name: "Proof of delivery of demand notice (AD Card)", nativelyDigital: false, uploaded: false },
  { id: 8, name: "Reply to the demand notice", nativelyDigital: false, uploaded: false },
];

const party1Documents = [
  { id: 101, name: "Aadhar Card Complainant", nativelyDigital: false, uploaded: false },
  { id: 102, name: "Power of Attorney", nativelyDigital: false, uploaded: false },
  { id: 103, name: "Vakalatnama", nativelyDigital: false, uploaded: false },
];

const party2Documents = [
  { id: 201, name: "Aadhar Card Complainant", nativelyDigital: false, uploaded: false },
  { id: 202, name: "Power of Attorney", nativelyDigital: false, uploaded: false },
  { id: 203, name: "Vakalatnama", nativelyDigital: false, uploaded: false },
];

export function DocumentUploadPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <StepSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl px-8 py-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">List of documents</h1>
            <p className="text-sm text-muted-foreground mb-6">
              No need to upload the affidavits or delay condonation application here. Please make sure the document is uploaded the right way up and is easy to read (not sideways or upside down).
            </p>

            <div className="flex items-start gap-2.5 rounded-lg border border-info-border bg-info-bg p-3.5 mb-8">
              <Info className="h-4 w-4 text-info-text mt-0.5 shrink-0" />
              <p className="text-sm text-info-text">
                Check the box if you are attaching an original document that is digital in nature, and not a scanned copy of a physical document.
              </p>
            </div>

            <DocumentTable title="Case details" initialDocs={caseDocuments} showQualityBadges />
            <DocumentTable title="Party 1 details" initialDocs={party1Documents} />
            <DocumentTable title="Party 2 details" initialDocs={party2Documents} />
          </div>

          <div className="sticky bottom-0 bg-card border-t border-border px-8 py-4 flex justify-end gap-3">
            <Button variant="outline" className="px-6">
              Save as Draft
            </Button>
            <Button className="px-6 gap-2">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
