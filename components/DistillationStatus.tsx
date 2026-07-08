export default function DistillationStatus() {
  return (
    <div className="grid grid-cols-4 gap-5 mt-6">
      <Card title="Alcohol" value="53.2 %" />

      <Card title="Temperatura" value="91.8 °C" />

      <Card title="Volumen" value="148.6 L" />

      <Card title="Tiempo" value="02:16" />
    </div>
  );
}

type CardProps = {
  title: string;
  value: string;
};

function Card({ title, value }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
      <p className="text-sm text-slate-400">{title}</p>

      <h2 className="mt-2 text-3xl font-bold text-white">
        {value}
      </h2>
    </div>
  );
}