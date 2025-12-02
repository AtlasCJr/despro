import './navbar.scss'

import { useState } from 'react';
import { DashboardLogo, ComponentsLogo, NotificationLogo, AboutLogo } from '../assets/icons';

type NavbarProps = {
    onChange: (page: number) => void;
};

export default function Navbar({ onChange }: NavbarProps) {
    const [selected, setSelected] = useState<number>(0)

    const menuItems = [
        { label: "Dashboard", icon: <DashboardLogo /> },
        { label: "Components", icon: <ComponentsLogo /> },
        // { label: "Analysis", icon: <AnalysisLogo /> },
        { label: "Notifications", icon: <NotificationLogo />, notifNum: 2, warningNum: 2 },
        { label: "About", icon: <AboutLogo /> }
    ];

    return (
        <div className="nav-bar">
            <img src="/images/Logo.webp" alt="Logo" />
            
            <ul>
                <div className={`cursor-selected level-${selected}`} />

                {menuItems.map((item, index) => (
                    <li key={index}>
                        <div>
                            <a className={index === selected ? 'selected' : ''} 
                            onClick={() => {
                                setSelected(index),
                                onChange(index)
                            }}>
                                {item.icon}
                                <h2>{item.label}</h2>
                            </a>
                        </div>

                        {/* {item.label === "Notifications" && item.notifNum != 0 && item.warningNum == 0 && <h3 className={selected !== 2 ? 'notif' : 'notif unshow'}>{item.notifNum}</h3>}
                        {item.label === "Notifications" && item.warningNum != 0 && <h3 className={selected !== 2 ? 'warning' : 'warning unshow'}>{item.warningNum}</h3>} */}
                    </li>
                ))}
            </ul>
        </div>
    )
}