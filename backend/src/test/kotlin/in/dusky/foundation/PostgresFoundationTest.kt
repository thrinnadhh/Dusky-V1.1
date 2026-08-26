package `in`.dusky.foundation

import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.flywaydb.core.Flyway
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.DriverManager

@Tag("postgres")
class PostgresFoundationTest {
    @Test
    fun `postgres infrastructure accepts deterministic integration query`() {
        PostgreSQLContainer("postgres:17-alpine").use { postgres ->
            postgres.start()
            val migration = Flyway.configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .load()
                .migrate()
            assertEquals(1, migration.migrationsExecuted)
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("select count(*) from foundation_marker").use { result ->
                        result.next()
                        assertEquals(0, result.getInt(1))
                    }
                }
            }
        }
    }
}
