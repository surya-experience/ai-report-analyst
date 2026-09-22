import { CampaignComposer } from "@/components/campaigns/campaign-composer";

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6">New campaign</h1>
      <CampaignComposer />
    </div>
  );
}
