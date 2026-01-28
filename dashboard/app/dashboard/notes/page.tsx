export default function NotesIndexPage() {
    return (
        <div className="h-full flex items-center justify-center bg-slate-50/20">
            <div className="text-center group">
                <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                    <span className="material-symbols-outlined text-4xl text-slate-200 group-hover:text-primary transition-colors">edit_note</span>
                </div>
                <p className="mt-6 font-semibold text-slate-400">Select a note to start editing</p>
                <p className="text-xs text-slate-300 mt-1">Your thoughts are waiting to be structured.</p>
            </div>
        </div>
    );
}
