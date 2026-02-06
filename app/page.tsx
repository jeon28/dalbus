"use client";

import Link from 'next/link';
import { useServices } from '@/lib/ServiceContext';
import styles from './page.module.css';

export default function Home() {
    const { services, user } = useServices();

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 className={styles.logo}>
                        <img src="/tidal-logo.svg" alt="Tidal Logo" className={styles.headerLogo} />
                        dalbus<span>.com</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {user ? (
                            <span className={styles.userName}><strong>{user.name}</strong></span>
                        ) : (
                            <Link href="/login" className={styles.loginLink}>LOGIN</Link>
                        )}
                        <Link href="/admin" className={styles.adminLink}>ADMIN</Link>
                    </div>
                </div>
            </header>

            <div className={`${styles.hero} container`}>
                <h2 className="animate-fade-in">PREMIUM STREAMING<br /><span>UP TO 80% OFF</span></h2>
                <p>Experience original sound quality without the full price.</p>
            </div>

            <section className={`${styles.services} container`}>
                <div className={styles.singleGrid}>
                    {services.map((s) => (
                        <Link href={`/service/${s.id}`} key={s.id} className={`${styles.card} glass`}>
                            <span className={styles.tag}>{s.tag}</span>
                            <div className={styles.cardContent}>
                                <div className={styles.iconWrapper}>
                                    {s.icon === 'tidal' ? (
                                        <img src="/tidal-logo.svg" alt="Tidal" className={styles.tidalStoreLogo} />
                                    ) : s.icon}
                                </div>
                                <h3 className={styles.serviceName}>{s.name}</h3>
                            </div>
                            <div className={styles.priceContainer}>
                                <span className={styles.subText}>START FROM</span>
                                <span className={styles.price}>{s.price}원</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <nav className={`${styles.bottomNav} glass`}>
                <Link href="/" className={styles.navItem}>🏠</Link>
                <Link href="/mypage" className={styles.navItem}>👤</Link>
            </nav>
        </main>
    );
}
