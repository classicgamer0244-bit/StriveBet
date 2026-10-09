export function LiveHeroBanner({ title }: { title: string }) {
  return (
    <div className="bg-gradient-to-br from-black via-neutral-900 to-primary-900 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white sm:text-3xl">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-live" />
        </span>
        {title}
      </h1>
    </div>
  );
}
