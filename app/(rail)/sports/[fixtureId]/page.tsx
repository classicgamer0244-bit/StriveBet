import { FixtureDetailClient } from "@/components/fixtures/fixture-detail-client";

export default async function FixtureDetailPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  return <FixtureDetailClient fixtureId={fixtureId} />;
}
