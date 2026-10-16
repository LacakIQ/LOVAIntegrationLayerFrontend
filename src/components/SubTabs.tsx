type SubTab = { id: string; label: string };

type SubTabsProps = {
  tabs: SubTab[];
  active: string;
  setActive: (value: string) => void;
};

export default function SubTabs({ tabs, active, setActive }: SubTabsProps) {
  return (
    <div className="flex overflow-x-auto space-x-6 border-b border-gray-200 px-6 bg-gray-50/50 flex-shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActive(tab.id)}
          className={
            'py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' +
            (active === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
