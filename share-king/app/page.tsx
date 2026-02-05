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
                    <h1 className={styles.logo}>Share King<span>.</span></h1>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {user ? (
                            <span className={styles.userName}><strong>{user.name}</strong> 님</span>
                        ) : (
                            <Link href="/login" className={styles.adminLink}>로그인</Link>
                        )}
                        <Link href="/admin" className={styles.adminLink}>Admin</Link>
                    </div>
                </div>
            </header>

            <div className={`${styles.hero} container`}>
                <h2 className="animate-fade-in">오늘부터 구독료,<br /><span>60% 절약</span>하세요</h2>
                <p>기다림 없는 자동 매칭, 안전한 계정 공유</p>
            </div>

            <section className={`${styles.services} container`}>
                <div className={styles.grid}>
                    {services.map((s) => (
                        <Link href={`/service/${s.id}`} key={s.id} className={`${styles.card} glass`}>
                            <div className={styles.cardHeader}>
                                <span className={styles.icon}>{s.icon}</span>
                                <span className={styles.tag}>{s.tag}</span>
                            </div>
                            <h3>{s.name}</h3>
                            <div className={styles.priceContainer}>
                                <span className={styles.subText}>월 이용료</span>
                                <span className={styles.price}>{s.price}원</span>
                            </div>
                            <button className={styles.button}>구독하기</button>
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
