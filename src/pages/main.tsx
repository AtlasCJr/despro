import { useState } from 'react'

import './main.scss'

import Navbar from './navbar'
import Dashboard from './dashboard'
import Components from './components'
import Notifications from './notifications'
import About from './about'

export default function Main() {
    const [curPage, changePage] = useState<number>(0);

    return (
        <>
            <Navbar onChange={changePage} />
            <div className='main-container'>
                {curPage === 0 && <Dashboard />}
                {curPage === 1 && <Components />}
                {curPage === 2 && <Notifications />}
                {curPage === 3 && <About />}
            </div>
        </>
    )
}