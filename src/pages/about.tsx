import './about.scss'

export default function About() {
    return (
        <div className='about'>
            <h1>About Us</h1>

            <div>
                <h2>
                    We are a team of undergraduate students from Electrical 
                    Engineering, class of 2022.
                    Guided by our lecturers, we initiated the kWh Meter Automation 
                    / Smart Power Grid Project as a response to the growing need 
                    for efficient, transparent, and reliable electrical energy 
                    monitoring.
                </h2>

                <h2>
                    Our project focuses on designing a multi-socket smart power 
                    strip equipped with individual current sensors, voltage 
                    measurement, and real-time data acquisition through an IoT-based 
                    ESP32 system. Combined with a web-based monitoring dashboard, 
                    this system enables users to track energy consumption (kWh), 
                    power factor, and predictive usage analytics in real time.
                </h2>

                <h2>
                    By integrating hardware, 
                    software, and data science, we aim to create a scalable solution 
                    that can be applied not only for academic purposes but also 
                    for real-world applications in households, industries, and 
                    public infrastructure.
                </h2>
            </div>
        </div>
    )
}