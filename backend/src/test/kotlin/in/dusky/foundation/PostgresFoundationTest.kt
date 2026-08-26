package `in`.dusky.foundation

import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.DriverManager

@Tag("postgres")
class PostgresFoundationTest {
    @Test
    fun `postgres infrastructure accepts deterministic integration query`() {
        PostgreSQLContainer("postgres:17-alpine").use { postgres ->
            postgres.start()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use { statement ->
                    statement.executeQuery("select 1").use { result ->
                        result.next()
                        assertEquals(1, result.getInt(1))
                    }
                }
            }
        }
    }
}
