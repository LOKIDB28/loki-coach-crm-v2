"use client";

import dynamic from "next/dynamic";

const ProvinceMapInner = dynamic(() => import("./ProvinceMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] w-full rounded-xl bg-bg flex items-center justify-center text-sm text-textSoft">
      Chargement de la carte…
    </div>
  ),
});

interface ProvinceMapProps {
  data: { province: string; count: number }[];
}

/** One bubble per province/state (never per city - see lib/geo.ts), sized by contact count. */
export function ProvinceMap({ data }: ProvinceMapProps) {
  return <ProvinceMapInner data={data} />;
}
