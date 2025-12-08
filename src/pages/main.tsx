import { useState } from 'react'

import './main.scss'

import Navbar from './navbar'
import Dashboard from './dashboard'
import Components from './components'
import Notifications from './notifications'
import About from './about'

export default function App() {
    const [page, setPage] = useState(0);

    return (
        <>
            <Navbar selected={page} onChange={setPage} />
            <div className='main-container'>
                {page === 0 && <Dashboard onChangePage={setPage} />}
                {page === 1 && <Components />}
                {page === 2 && <Notifications />}
                {page === 3 && <About />}
            </div>
        </>
    );
}