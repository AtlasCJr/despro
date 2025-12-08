import './navbar.scss'

import { DashboardLogo, ComponentsLogo, NotificationLogo, AboutLogo } from '../assets/icons';

import Logo from "../assets/images/LogoText.png";

type NavbarProps = {
    selected: number;
    onChange: (page: number) => void;
};

export default function Navbar({ selected, onChange }: NavbarProps) {
    const menuItems = [
        { label: "Dashboard", icon: <DashboardLogo /> },
        { label: "Components", icon: <ComponentsLogo /> },
        { label: "Notifications", icon: <NotificationLogo />, notifNum: 2, warningNum: 2 },
        { label: "About", icon: <AboutLogo /> }
    ];

    return (
        <div className="nav-bar">
            <img style={{ scale: 1.2 }} src={Logo} alt="Logo" />

            <ul>
                {/* This should change when `selected` changes */}
                <div className={`cursor-selected level-${selected}`} />

                {menuItems.map((item, index) => (
                    <li key={index}>
                        <div>
                            <a
                                className={index === selected ? "selected" : ""}
                                onClick={() => onChange(index)}
                            >
                                {item.icon}
                                <h2>{item.label}</h2>
                            </a>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
