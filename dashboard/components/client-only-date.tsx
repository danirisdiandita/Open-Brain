"use client";

import { useEffect, useState } from "react";

export function ClientOnlyDate({ date }: { date: string | Date }) {
    const [formattedDate, setFormattedDate] = useState<string>("");

    useEffect(() => {
        setFormattedDate(new Date(date).toLocaleDateString());
    }, [date]);

    if (!formattedDate) {
        return <span className="invisible">loading...</span>;
    }

    return <span>{formattedDate}</span>;
}
